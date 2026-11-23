# CH-153 — Cible et réglage figés avant rejeu (R1, Lot C1 + C0)

**Date** : 21/11/2026 · **Branche** : `chantier/CH-153` · **Base** : `11b15548` (`ariane6`).

## 1. Réglage figé avant tout rejeu

### Volet C0 (signaux d'écartement, D-380 / D-381)
- `BananeSettings.lot.serrageLotOmbre.actif = false` (écarté suite aux mesures sur les Échos des parties 28–33).
- `garde-voie-ombre` (`seuilMm = 15`) conservé actif et branché dans `src/correction-liste.js` comme signal `'garde-voie'` (groupe `'corriger'`, détail `{ ecartMm, referenceMm, ecartAuVoisinageMm }`) pour les coupes posées par le lot où `auraitPause === true`, en complément du pré-filtre de relecture D1 (`alertesGardeVoie`).

### Volet C1 (`gA` + `v4BS-sd` + `voieListe`, uniquement sur les différés et sans ricochet)
- `BananeAncreTrajectoire.graineAxe(E, cut, capture, gRefMm)` : projette l'axe cinématique établi au cut (`!ax.muet`, calage rigide cohérent avec la translation du lot) en graines `[latMm, 0]` dans le repère profil de chaque rail de départ à `±gRefMm / 2`.
- Leviers C1 dans `src/gcv2-l1.js` (`LEVIERS_V8`, coupables par `reglerLeviers` pour vérifier l'identité stricte éteint = tronc) :
  - **Invariants d'isolation** :
    - `c1SeulementDifferes: true` : n'agit que lorsque la décision livrée (v7) rend `etat === 'rien'` ; toute pose de la chaîne ou de GCV2 v7 reste inchangée au bit près ;
    - `c1SansRicochet: true` : toute pose nouvellement validée par C1 porte `voisinLivre: { etat: 'rien', positions: null }` et n'entre pas dans le transport `validesL1` / `l1eTransport` (aucun ricochet sur les cuts suivants).
  - **Pool H8 (`v4BS-sd` guidé par l'axe)** :
    - Si l'axe est établi, relance sur la graine d'axe `gA` (et `±55 mm` autour d'elle) ; sinon, en `abords` / `pn` sans paire à l'écartement dans le pool (`c123SansPaire: true`), balayage `[-240, -160, -80, 80, 160, 240]` (`v4BS-sd`, D-360) ; cellules `topRows >= 15`, `dessus >= 5`, appariées à `<= 10 mm` de l'écartement de référence, et à `<= 75 mm` de l'axe quand l'axe juge.
  - **Recherche recentrée sur l'axe (`rechAxe: true`) et `voieListe` (`rechListeResMm: 4`)** sur un cut resté à `etat === 'rien'` :
    - Graine `gA` (et `voieListe` en `abords` encadrés avec résidu `<= 4 mm`) ;
    - Preuve forte exigée sur les deux rails : `fort === true`, `top >= 60`, `face >= 6`, `ratio <= 1.5`, soutien direct `dessus >= 5` et `flanc >= 3`, écartement à `<= 10 mm` de la référence de la liste, hauteur `<= 25 mm`, unicité stricte (`!ambigu` à `15 mm`) ;
    - Proximité en travers au centre de l'axe : `<= 35 mm` en `abords` / `pn`, `<= 45 mm` en `adv` (et `<= 18 mm` de `voieListe` si repli liste sans axe).

## 2. Règle de décision (portes R1–R5 écrites d'avance)
1. **Éteint = tronc** : 100 % des cuts identiques ligne à ligne sur la garde d'octobre et le corpus.
2. **Garde d'octobre (`tools/garde-gcv2.cjs`)** : **0 juste du tronc perdu, 0 juste du tronc dégradé au-delà de 10 mm (ni de plus de 2 mm), 0 pose nouvelle > 50 mm, 0 mauvaise voie nouvelle, 0 pose de la chaîne déplacée**.
3. **Corpus CH-116 (4 016 cuts, zones du journal, passe fidèle plafond 10) et validation croisée « un lot dehors »** : gain net de différés reposés justes (cible attendue : **+10 à +35 différés reposés justes** sur le corpus, englobant les +7 de `v4BS-sd`), **0 pose nouvelle > 50 mm**, au plus 1 pose nouvelle jugée sur 10 dans `10–50 mm`, **0 juste du tronc perdu ou dégradé > 10 mm**, coût croisé inférieur au livré.
