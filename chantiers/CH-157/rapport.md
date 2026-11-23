# CH-157 — Rapport : traits d’axe C6, réentraînement différé

**État : socle C6 terminé et intégré ; réentraînement reporté sur ordre de l’opérateur.** Les paramètres GCV2 historiques restent inchangés. Aucune partie réservée, aucun examen vierge et aucune partie du lot du 18/11 n’ont été lus.

## Implémentation

- `BananeGcv2L1.NUM` et la liste blanche de `tools/gcv2-apprendre.cjs` connaissent `ecartAxeMm`, `paireMilieuAxeMm` et `ancrePresente`.
- Les traits sont calculés depuis la graine d’axe, sans la pose finale de l’opérateur. `deciderDiffere` ne calcule la graine que pour un modèle qui déclare ces colonnes ; la copie de l’état d’ancre évite toute mutation anticipée du calage historique.
- Rétrocompatibilité stricte : avec le modèle v1 livré, décisions et positions restent identiques au bit près, que la graine soit présente ou non. Un modèle v2 qui déclare `ecartAxeMm` pondère effectivement ce trait.
- `tools/gcv2-jeu.cjs` accepte `--liste`, propage la graine dans les deux jeux (relecture et lot) et écrit `ancrePresente` dans le contexte JSONL. Sans liste, les jeux restent rétrocompatibles.
- L’export n’ajoute les trois colonnes à la liste blanche livrable que si un jeu porte réellement l’ancre. Les anciens jeux les ignorent.
- La façade du réservoir et les essais ont été recalés sur les changements déjà intégrés par CH-153 et CH-155.

## Preuves (ÉTABLI)

- Quatre essais CH-157 couvrent la liste blanche, les traits, la rétrocompatibilité au bit près, la pondération v2, la propagation JSONL et la décision L1.
- Batterie bornée à 15 minutes : **154 essais, 153 réussis, 0 échec, 1 ignoré déclaré** (archive source avec corpus privé).
- Inclus : CH-157, constructeur et apprentissage GCV2, GCV2 L1, CH-153 à CH-156, CH-146 et CH-148 à CH-151, service worker, empreintes du lot, interdiction des noms de modèles et fabrication du paquet.
- `node --check` passe sur les trois outils/modules modifiés ; `noms-modeles` et `package` passent.

## Réentraînement

Non lancé, pour économiser le quota et éviter un calcul long non indispensable à cette bêta. En conséquence, **aucun gain de différés ou de poses justes n’est revendiqué** et `datasets/gcv2-parametres-h6.json` / `src/gcv2-parametres-l1.js` ne sont pas remplacés. Le juge réservé D-379 n’a pas été consommé. Le socle permet de lancer cet entraînement ultérieurement, hors réserves, puis de n’accepter un modèle v2 que si toutes les gardes sont vertes.
