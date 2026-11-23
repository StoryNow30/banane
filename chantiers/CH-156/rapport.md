# CH-156 — Rapport : sens par courbe / `trajAzimuth` et garde de courbure

**État : code et essais terminés.** Mesures locales **ÉTABLIES**, sans écriture dans ESV et sans lecture de la réserve D-379.

## Implémentation

- `coutCourbe` évalue le coût cinématique uniquement sur les lignes de voie courante en courbe (`max(|pP|,|pM|) ≥ 10 mm`) : le sens n'est plus dilué par des milliers de coupes droites, et `rapportSens` dépasse le seuil prudente de 1,10. Le sens choisi reste subordonné à l'accord avec le sens global.
- Support optionnel de `trajAzimuth` (radians ou degrés) lorsqu'il est présent sur la table : majorité ≥ 90 % avec direction de coupe quasi perpendiculaire, jamais d'azimut inventé sinon.
- `jugerCourbure` compare la pose aux droites locales des voisins sur 5 coupes (vertical et latéral avec correction de courbure cinématique) : refuse une flèche verticale > 55 mm, un gauchissement > 40 mm ou des voisins incohérents > 15 mm. Muet si moins de 2 voisins exploitables.
- Branchement dans `BananeDecisionLotPartagee` pour L1-se et la deuxième passe, sans ricochet de transport.

## Preuves

- `tests/ch156-c5-sens-et-courbure.test.cjs` : **3/3**.
  - partie longue à courbe courte : sens retrouvé dans les deux directions avec rapport global < 1,10, sans mutisme et axe à ≤ 10 mm malgré le bruit.
  - partie purement droite : `trajAzimuth` oriente explicitement `sens = -1`.
  - pose régulière acceptée ; pose à +85 mm en hauteur refusée par `jugerCourbure`.
- Batterie CH-156 + CH-155 + CH-154 + CH-153 + CH-124 + GCV2 + CH-146 à CH-151 + empreintes et paquet : **109 réussis, 0 échec, 1 ignoré déclaré**.
- `pose-lot-inchanges-4959`, `noms-modeles`, `package` : **0 échec**.

La mesure globale sur les lots d'octobre et la réserve D-379 n'est **pas** rapportée ici : elle sera mesurée séparément avant livraison.
