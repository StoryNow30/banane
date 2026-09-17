# Geometry Candidate V1 — spécification figée

Artefact scientifique. **Pas une branche d’intégration runtime.** Réplication indépendante requise avant tout ESV.

- Base Banane : `0f6846f` / lab NEXT V0 `9e40ad2`
- Qualification : `(après commit)` branche `lab-geometry-engine-next-v0-qualification`
- Composition hash : `0ea0824fb9e0b763d575ee95784475632f7fe2fd18e684b68e9f765106b6b27a`
- A_STAR hash : `e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f`
- geometry.js : `77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503`
- geometry-baseline.js : `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` (inchangé)

## Moteur

NEXT V0 = A_STAR + SUPPORT_FALLBACK_15 (S1). S2 exclu.

### A_STAR

- médiane U des points locaux moteur via `hypothesesA`
- replaceOrigin : false
- recenterWindow : true
- searchY : **0.08** · searchZ : **0.04** · grid : **0.003**
- minTop : **15** · minFace : **6**
- pas un searchY global

### S1 SUPPORT_FALLBACK_15

- si A_STAR déjà STRONG (candidate ∧ top≥15 ∧ face≥6 ∧ !slopeLimited) : **ne rien faire**
- sinon competitive set loss/Lmin ≤ **1.5** (constante V4.6 `minTemplateLossRatio`)
- unique cluster STRONG (union-find, alternativeSeparation **0.02**) : min-loss du cluster
- plusieurs clusters : **AMBIGUOUS** (abstention)
- aucun STRONG compétitif : conserver le motif A_STAR

### Abstention

- flanc / minTop / pente / fenêtre / ambiguïté : inchangés
- S1 ne publie jamais PARTIAL_FACE ni WEAK_FACE

## Gates de validation

- parité 239/239 contre ce gel
- 0 PARTIAL/WEAK publié
- 0 déjà-STRONG déplacé par S1
- 0 far S1
- 5146 = VALID_ALTERNATIVE
- 102/103/105 non WORSENED

## Population

Lock RSF 239 (63 failures + 176 controls), dataset native-v4.6-2026-09-16 @ d541686d.

## Limitations

- Pas un holdout aveugle (Prototype V1 a vu 221/239 ; 53+53 ont servi au développement).
- 9644 : NEXT = V4.6, loin de l’humain (~0.130 unité de scène). Restauration de témoin, pas une correction oracle.
- 154 G : A_STAR déplace de ~0.030 vs V4.6 ; post-hoc humain IMPROVED. S1 inactif.
- Unités de scène uniquement.

## Cas non résolus

- 38 RSF encore unresolved
- 5 flancs insuffisants (5090, 5113, 5125, 5151, 5240) : S1 s’abstient
- extras 102/103/105 unresolved : ABSTENTION
