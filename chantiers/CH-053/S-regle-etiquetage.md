# Règle d'étiquetage proposée — CH-053-S (à décider par l'opérateur ; rien n'est activé)

1. **Écho allumé pour toute validation manuelle**, y compris le travail de rattrapage après un lot. Le 04/11, partie 10 : 337 différés, 319 passés « valides, traités » dans la liste d'ESV sans une seule référence Écho (ÉTABLI) ; seules 18 validations, hors série, ont été observées.
2. **Une validation sans mouvement en moins de 1,5 s n'est pas une référence d'apprentissage** (réflexe) ; elle reste enregistrée (étiquette `VALIDATE_NO_MOVEMENT`), mais est écartée des jeux d'apprentissage. Elle n'est pas écartée d'un jugement de posé (la visite immobile ≥ 0,8 s reste un « contrôlé bon »).

## Effet chiffré sur le jeu du 04/11 (`tools/file-prioritaire.cjs simuler`, ÉTABLI)
| | avant | après règle 2 |
|---|---|---|
| références | 134 | 124 (10 retirées : 5 qualifiées, 0 informative) |
| paires qualifiées | 82 | 77 |
| informatives | 50 | 50 |
| part informative | 37,3 % | 40,3 % |
| taux apprenables | 61,2 % | 62,1 % |
Les 7 autres validations sans mouvement (visite d'au moins 1,5 s) restent. Aucune information perdue : les 10 retirées ont 0 correction de plus de 10 mm.
Effet de la règle 1 (SUPPOSÉ, à ne pas citer comme mesure) : à 10 informatives sur 19 références obtenues en partie 10, les 319 validations non observées auraient donné de l'ordre de 170 informatives.
