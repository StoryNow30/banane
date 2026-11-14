# CH-124 : passation (14/11, écrite à 11 h 20 UTC, mise à jour à chaque jalon)

## Où en est le chantier
- **Ancre trouvée (ÉTABLI).** L'axe de la voie relevée se prédit depuis la trajectoire du véhicule de mesure, lue dans la liste d'ESV du départ de la partie (`src/ancre-trajectoire.js`, dans `ancre.patch`). Mesures et contre-vérification : `sorties/`, `sorties/contre-verification.md`.
- **Levier N (refus d'ancre, θ = 75 mm, sans ricochet), figé dans `reglage-fige.md`.** D-355 : allumé d'office dans la Vision 18 dès que sa parité est bonne.

| preuve de N | résultat | où |
|---|---|---|
| garde d'octobre jugée contre la vérité (R6) | 2 362 cuts, 13 refus, 13 vraies corrections, 0 faute, 0 autre cut changé | `sorties/garde/` |
| corpus, première passe (ancien arbre) | 4 016 cuts, 32 refus : 29 vraies corrections, 0 faute, 3 non jugés ; 0 autre cut changé ; > 50 mm 29 → 0 | `sorties/corpus/N-premiere-passe-ancien-arbre*` |
| éteint = livré (ancien arbre, première passe) | 4 016 identiques sur 4 016 | `sorties/corpus/eteint-contre-livre.md` |
| examens vierges (mesure de CH-116) | 3 refus, 3 vraies corrections, rien d'autre ne change | chez CH-116 |
| parité, lot d'octobre 0-2310-lot2 | 91 lignes identiques sur 91 | `sorties/parite/parite-octobre-lot2.md` |
| parité, 12/11 p23 | EN COURS (lancée à 11 h 12 UTC, environ 100 min) | `sorties/parite/` |
| corpus en zones du journal et passe fidèle (éteint, puis N) | À FAIRE après la parité ; la référence « livré » de ce réglage est rejouée (hors dépôt) | — |

- **N+ (reprise sur le pool restreint à l'ancre)** : réglage figé AVANT tout rejeu (`reglage-fige-reprise.md`), incrément `ancre-reprise.patch`, essais verts. **Jamais rejoué.** Non couvert par D-355. À reprendre par une session neuve.

## Patchs (s'appliquent sur le tronc, vérifié par l'intégrateur à 823b5e7)
- `ancre.patch` : `55c63f314ac2c379dff3c9eeed9aae60a4a9f65bf6d6517198d5895bc868467c` (ancien arbre : `214e55aa…`, mêmes lignes ajoutées et retirées).
- `sw-ancre.patch` : `5c7c1fef2d3c0af5126af147dd1d9ccecdd0c44089dc2026213815b198940f31`.
- `ancre-reprise.patch` (N+, après `ancre.patch`) : `a54ffbf696d4c8bd7b04dd6f927ac3ddea1c25e4e1eeb5ed46c79865b1e7e77e`.
- Fichiers à intégrer et déclarations : `INTEGRATION.md`.

## Pour reprendre
Données hors dépôt (perdues avec la session) : corpus et banc de CH-116 (`chantiers/CH-116/outils/LISEZMOI.md` : `extraire.sh`, `preparer.cjs`, `banc.cjs rejouer --nom livre`), lots d'octobre de la garde (`BANANE_LOTS`). Ne jamais extraire les examens vierges réservés.
- Rejeu de jugement (réglages par défaut du 14/11) : `banc.cjs rejouer --nom X --patch chantiers/CH-124/ancre.patch --env BANC_ZONES=journal --env BANC_PASSE_PLAFOND=10 --env 'BANC_LEVIERS={"deuxiemePasse":2,"passe2Leviers":{"sansVoieRien":true},"ancre":true}'` ; référence « livré » : même commande sans patch ni `ancre`.
- Jugement cut par cut : `node chantiers/CH-124/outils/refus.cjs corpus --ref <livré> --nom X` (ou `garde --ref <éteint> --nom X`) ; tableau standard : `banc.cjs juger --nom X --ref <livré>`.
- Parité : copie du code avec les deux patchs ; liste de départ par `outils/liste-depart.cjs` ; référence du banc par `tools/banc-differes.cjs rejouer … --profils L1-se --liste DEPART` avec les leviers de la passe et `"ancre":true`, **sans** `BANC_ZONES=journal` pour un lot ancien ; puis `tools/parite-l1se-sw.cjs … --racine COPIE --leviers '{"ancre":true}' --passe`.
- N+ : garde d'octobre d'abord (`banc.cjs garde --nom Np --patch ancre.patch --patch ancre-reprise.patch --env 'BANC_LEVIERS={"ancre":{"reprise":true}}'`, puis `refus.cjs garde`), corpus ensuite, décision selon `reglage-fige-reprise.md` §4. L'incrément du service worker pour N+ n'est pas écrit.

## Pièges mesurés
- La parité n'a pas de reprise et le vrai service worker va environ 11 fois moins vite que le banc : 32 min pour 91 cuts, environ 100 min pour 12/11 p23 (3 s par cut au début, 20 s à la fin). Un conteneur sans tâche suivie est repris au bout de quelques minutes : garder une tâche suivie vivante pendant un long rejeu détaché.
- `BANC_ZONES=journal` dans la référence d'une parité fabrique des écarts sur un lot ancien (4 lignes sur 91 en octobre).
- Passe et plafond de 10 : une pose de passe refusée par l'ancre ne prend aucune des 10 écritures (`reglage-fige.md`, note du 14/11) ; à compter à part dans le rejeu en passe fidèle.
- L'export ne garde que le dernier instantané de la liste d'une partie ; le banc reconstitue la liste du départ (`listeDeDepart`).

## Non mesuré
- Le signal de cap (direction de la coupe contre la tangente de la voie) : la position suffit, et le cap ne se lit pas dans une seule coupe.
- Où N+ repose les cuts refusés.
