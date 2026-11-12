# CH-118 : rapport (précision des poses justes, D-351)

Hors ligne. Aucun fichier du tronc changé. Détail : `analyse.md` ; réglages figés avant jugement : `reglage-fige.md` ; sorties par cut : `sorties/`.

## 1. Les retouches de 5 à 50 mm (Échos du 12/11 ; lots des 11 et 12/11 ; 126 posés avec une pose de l'opérateur) — ÉTABLI
- 49 retouchés de 5 à 50 mm (17 au-delà de 10 mm). Longitudinal toujours nul. Pas de biais d'écartement (médiane −1,1 mm), ni de latéral commun (+0,6 mm).
- **Biais vertical** : un rail dont le calage de convention est refusé (dz > 8 mm, `shift-out-of-domain`) est posé brut. 16 rails sur 16 posés ainsi sont retouchés, remontés de dz à +0,3 mm près en médiane. Ce biais pèse 15 des 49 retouches et 6 des 17 au-delà de 10 mm.
- **Biais latéral à un rail** : 5 à 13 mm, surtout dans la partie 16 du 11/11 et en appareil de voie. Signe sans tendance, aucun prédicteur trouvé (même constat que CH-042). Il attend le banc de CH-116.

## 2. Levier « domaine étendu » (calage entier jusqu'à dz 13 mm), patch éteint `domaine-etendu.patch` — CLOS
| Jeu (posés jugés) | ≤ 10 mm avant → après | gagnés / perdus à 10 mm | posés passés au-delà de 20 mm | > 50 mm |
|---|---|---|---|---|
| 14/10 p17, rejeu du vrai code (188) | 141 → 160 | 26 / 7 | **4** | 0 → 0 |
| 14/10 p17, simulation statique (192) | 145 → 162 | 25 / 8 | **4** | 0 → 0 |
| 05 au 12/11, 19 parties, simulation statique (442) | 371 → 378 | 7 / 0 | 0 | 32 → 32 |
| 05 au 12/11, avec le séparateur figé `faceN ≤ 20` (442) | 371 → 372 | 1 / 0 | 0 | 32 → 32 |
- Partie 17 d'octobre : les 99 rails refusés sont posés bruts, et l'opérateur ne remonte que 0,64 × dz. Sur les 4 cuts passés au-delà de 20 mm, il descend le rail de 12 à 20 mm. Critère du ticket non tenu : arrêt (condition de l'intégrateur).
- (b) Rapport opérateur/dz : 0,92 du 05 au 08/11 (5 rails seulement), 1,03 les 11 et 12/11 (16 rails), 0,64 en octobre (99 rails). Ce qui diffère en octobre, pour TOUS les rails : dz médian 4,9 mm (1,6 à 3,8 en novembre) ; 23,7 % des rails à dz > 8 (0 à 12 % en novembre) ; version 4.9.0.12, sans lecture Rust au journal. La cause (lecture du nuage, version, nature de la voie) reste SUPPOSÉE.
- (c) Séparateur réglé sur octobre (`faceN ≤ 20`) : sans faute en novembre, mais il retire 6 des 7 gains. En novembre, les rails à 21-34 points de flanc sont bien remontés de dz, parce que le nuage y est 3 à 4 fois plus dense. Une densité relative (points de flanc / points du rail) se lit après coup sur novembre : elle n'est plus jugeable sur ces lots (SUPPOSÉ, à figer et à juger sur un Écho neuf).
- Aiguillages et mauvaises voies (condition 3), novembre : 12 cuts touchés en zone d'alerte ou de marge sans séparateur (6 avec), aucun dégradé de plus de 2 mm ; aucune pose ne passe au-delà de 50 mm et aucune n'en sort. Le ricochet par les appuis est ignoré par la simulation : 1 cut sur 268 au rejeu du 14/10.
- **Verdict** : levier vertical clos. Gain réel sur les lots de novembre (+7 à 10 mm, médiane verticale des justes ramenée à 0 sur les parties 1 et 2 du 12/11), mais il n'est pas sûr sur un lot comme celui d'octobre, et aucun séparateur ne tient hors échantillon. À rouvrir seulement avec un Écho neuf, sur un lot où beaucoup de rails sont refusés, et une règle de densité figée avant.

## 3. Cible du ticket
Non atteinte : 98 % de posés à 10 mm n'est approché par aucun levier sûr. Lots du 05 au 12/11, posés jugés hors mauvaises voies : 371 sur 410 (90,5 %) avant ; avec le levier sans séparateur, 378 (92,2 %).
