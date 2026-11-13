# CH-119 : cible chiffrée (écrite et poussée avant le premier rejeu, D-222, D-352)

Écrite le 13/11/2026, avant toute mesure du pool et tout rejeu. Rien de ce qui suit ne sera retouché après le premier rejeu ; un réglage retouché après jugement est un nouveau réglage, jugé à part.

## Référence
Banc de CH-116 (`chantiers/CH-116/outils/banc.cjs`), profil livré L1-se, deuxième passe éteinte (comme le banc), juge de CH-113 (pire rail, 3D ; juste ≤ 10 mm ; mauvaise voie > 50 mm). Rejeu du code livré (« livre », `banane-data/outils/analyse-lots/CH-116/sorties/banc-livre.md`) : 561 posés jugés, 496 ≤ 10 mm, 36 de 10 à 50, **29 > 50** (toutes en ADV), 591 différés, 4 bons bloqués. Le rejeu « livre » sera refait sur ma copie des captures et comparé à ces chiffres avant toute mesure (même code, mêmes données : identique attendu).

## Cible (validation croisée « un lot dehors »)
Lots réglables : 0411, 0611, 0811a, 0811b, 1111, 1211. Examen : 0511 (jamais regardé pour régler). Pour chaque lot réglable, les poids des coûts et le seuil d'ambiguïté sont choisis sur les cinq autres, puis jugés une fois sur lui ; la cible porte sur la **somme des six lots tenus à l'écart**.
1. Mauvaises voies (posés jugés > 50 mm) : **29 → ≤ 10**.
2. **0 nouvelle** : aucun cut posé ≤ 50 mm (ou différé) par le livré ne passe au-delà de 50 mm.
3. **Aucun juste passé au-delà de 10 mm** : aucun cut posé ≤ 10 mm par le livré n'est posé au-delà de 10 mm.
4. Coût en différés chiffré et borné : justes du livré devenus différés (bons bloqués nouveaux) **≤ 2 par mauvaise voie retirée** ; tous les différés ajoutés listés par cut.
5. Examen 0511 : aucun recul (mêmes critères 2 et 3, bons bloqués nouveaux ≤ 2).
6. Garde de pose (`node tools/garde-gcv2.cjs --rejouer`, 11 lots d'octobre) sur le réglage figé : **aucun recul** (retour 0). Parité banc / service worker (`tools/parite-l1se-sw.cjs --passe`) identique, à l'éteint (rejeu = livré, 4 016 / 4 016) comme au réglage figé.

Si 1 n'est pas atteint avec 2 à 6 tenus, le levier est rapporté comme non concluant, avec la raison mesurée (en particulier la borne du pool : part des mauvaises voies dont la bonne paire est absente du pool de la GCV2).

## Ordre
1. Mesure du pool en ADV (borne du levier), sans réglage.
2. Choix global par zone (programmation dynamique) : conception sur les lots réglables, réglage figé et poussé avant le jugement croisé.
3. Jugement croisé, examen, garde, parité. Rapport d'une page.
