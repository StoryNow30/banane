# Portes de banc de J1 (4.8.5 test 1)

Outil : `tools/portes-j1.cjs` (D5). Entrées : banane-data
`travail/2026-09-28_banc-485/preparer.sh S`, puis :

    node tools/portes-j1.cjs --entrees S/entrees.env [--verify]

Durée : environ 15 min (4 lots de validation, puis 8 jeux, un processus
chacun). Code de sortie 0 si toutes les portes sont vertes.

## Référence `reference-4.8.0.json`

- Figée le 28/09 depuis `b918b2a` (arbre propre ; empreinte `215f38a24a985a03`).
  **Code de décision** (`src/`, `vendor/`) identique à `v4.8.0` (`fabd77e`),
  sauf `src/native-session.js` (compteur de segments d'Écho, KI-066, hors
  décision) ; `background.js` et `panel.js` changent aussi pour KI-066.
  **Outils de rejeu** changés entre les deux : `first-pass-signal-study.cjs`
  (`--base-seule`, base rendue cut par cut, garde d'écartement bas étudiée ;
  la décision de base n'y change pas : bilan du 28/09 régénéré à l'identique)
  et `acceptance-report.cjs` inchangé.
- SHA-256 `a544643d1c0ae2a03213fd0f28b5ba08ad0259fc5b53f802d0e5a23530401a8d`.
- **Validation** : 633 cuts, rejoués avec les règles de leur lot
  (`acceptance-report --rejeu-lot --decision-par-rejeu`) : partie 9, lot
  4.7.18 réduit à son lot (346) et lot 4.7.19 (85) ; partie 11, lot 4.7.20
  (96) ; partie 12, lot 4.7.20 (106). Cuts 9033 et 9241 exclus.
- **8 jeux** (a à h, 13 sessions, 1 398 cuts) rejoués avec les règles
  actuelles (`first-pass-signal-study --base-seule`) : 1 029 posés, 646 jugés,
  10 faux, comme le bilan du 28/09 (`bilan-premier-passage-bas.json`, régénéré
  à l'identique le 28/09 au soir).

## Premier passage (28/09, code `b918b2a`, avant D2)

    VERT  633 cuts de validation : 0 décision changée ; parité p9-4.7.18 313/346, p9-4.7.19 85/85, p11-4.7.20 95/95, p12-4.7.20 106/106
    ROUGE 8 jeux : natif-p11:707 attendu refusé, inchangé ; 711 idem ; 718 attendu posé, inchangé ; 0 juste perdu

Rouge attendu : la garde d'écartement bas (D2) n'est pas encore codée.

## Question ouverte

Parité rejeu/observation du lot 4.7.18 de la partie 9 : **313 sur 346**. La
porte exige seulement qu'elle ne bouge pas. Hypothèse, non vérifiée : le lot
est réduit à ses observations (recette, étape 3), et le rejeu ne voit plus les
appuis validés dans les deux autres lots du même diagnostic. À
confirmer au banc de fond, sans effet sur J1.
