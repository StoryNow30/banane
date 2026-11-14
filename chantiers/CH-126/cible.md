# CH-126 : cible de N+, écrite et poussée avant le premier rejeu (14/11)

Aucun rejeu de N+ n'a été fait au moment d'écrire ce fichier. Réglage et règle de décision : ceux de `chantiers/CH-124/reglage-fige-reprise.md` (origin/chantier/CH-124), non retouchés.

## Patch
- Incrément figé par CH-124 : `ancre-reprise-apres-correctifs.patch`, sha256 `8c63f7f2e22d1cd927142bf90b22e877018e02c8e0d4aeaaa1de4143a605251c`. Il ne s'applique plus tel quel sur le tronc d'aujourd'hui (d0503f0) : une ligne de contexte de `src/gcv2-l1.js` a changé (exports d'aj5 : `LEVIERS_V7,ajusterPoseFinale,AJ_DEFAUT,AJ_ESSAI`).
- Régénéré contexte seul : `chantiers/CH-126/ancre-reprise-tronc.patch`, sha256 `6506fd38e0a0c2098b173b7b378b4659c749b758ebdb6d1f3e663dae7c07d678`. Lignes ajoutées et retirées identiques à l'incrément figé (comparées par `diff`, 0 écart, ÉTABLI). Essais `tests/ch124-ancre.test.cjs` : 15 sur 15 avec le patch.

## Cible chiffrée
- Terrain : les 35 refus de N sur le corpus (zones du journal, passe fidèle, CH-124 `sorties/corpus/N-zjp*`), dont 30 vraies corrections jugeables contre la vérité et 5 non jugés (sans vérité).
- **Attendu (SUPPOSÉ, avant tout rejeu) : 8 refus reposés à 10 mm au plus de la vérité**, fourchette 4 à 14. Raison : la vérité de ces 30 cuts est à moins de 17 mm de l'axe, donc dans la fenêtre ; mais ce sont des cuts d'ADV où la bonne paire manque souvent au pool (CH-120, CH-123), et le lot nettoyé retire des appuis, ce qui fera échouer la validation de la GCV2 sur une bonne part d'entre eux. Je m'attends à ce que la plupart restent différés.
- Gain compté : le nombre de refus reposés à 10 mm au plus de la vérité (cuts rendus à l'opérateur en moins).

## Critère d'échec (règle écrite d'avance, § 4 du réglage figé, recopiée sans changement)
- Garde d'octobre verte seulement si : aucun cut changé hors des cuts refusés par N ; mêmes refus que N ; aucune reprise posée à plus de 50 mm de la vérité.
- N+ n'est proposé que si, garde et corpus réunis : **0 reprise posée à plus de 50 mm de la vérité** et **au plus une reprise jugée sur dix à plus de 10 mm**. Sinon N reste seul.
- Corpus : 0 ricochet attendu (R3) ; tout cut changé hors des refus de N est un échec de l'hypothèse « sans ricochet » et se rapporte comme tel.
- Une reprise sans vérité n'est pas jugée et ne compte ni comme gain ni comme faute ; leur nombre est rapporté.
