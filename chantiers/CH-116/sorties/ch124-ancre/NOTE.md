# Jugement unique du levier d'ancre N de CH-124 sur 1211v et 1312v (CH-116, 14/11 ; ÉTABLI)
Patch `chantiers/CH-124/ancre.patch` (a4eef66, sha256 214e55aa…), `BANC_LEVIERS={"ancre":true}` (défauts du module, θ 75 mm), `BANC_ZONES=journal`, passe éteinte puis `BANC_PASSE_PLAFOND=10`. Vérité 1312v : segments 1 à 10.
Code rejoué : arbre de a4eef66 + patch tel quel, avec les options BANC_ZONES et BANC_PASSE_PLAFOND du banc réinsérées à l'identique (le patch ne s'applique ni sur le tronc ni sur chantier/CH-116). Référence : livré avec les mêmes réglages (`livre-zj`, `livre-zj-pf`).
- Éteint = livré : 152/152 et 1 307/1 307, avec et sans passe (`controle-eteint.md`).
- Refus : 1211v 4/6916 (GCV2, écart à l'axe −118,8 mm, pose refusée à 133,7 mm de la pose finale) ; 1312v 6/462 (GCV2, −149 mm, 155,6 mm) ; avec la passe, aussi 6/463 (pose de la passe, −118,7 mm, 124,1 mm). Toutes de vraies corrections (> 50 mm) ; 0 vraie faute ; 0 non jugé.
- Décisions d'état changées hors des cuts refusés : 0 ; aucune pose déplacée (`deplacements.md`).
- Ancre muette : 1312v p7 (sans liste exportée) ; active dans les 14 autres lots-parties.
- Tableau : mauvaises voies 1 → 0 (1211v), 1 → 0 (1312v), 2 → 0 avec la passe ; les trois cuts deviennent des différés ; reste inchangé (`juger-*.md`).
