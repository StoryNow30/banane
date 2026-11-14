# CH-124 : réglage figé du levier d'ancre (écrit et poussé avant tout rejeu du levier)

Écrit le 13/11/2026 après la mesure de l'étape 1 (`sorties/ancre-corpus.md`) et avant le premier rejeu du levier, la garde et la validation croisée. Un réglage retouché après jugement est un nouveau réglage, jugé à part.

## 1. L'ancre (aucune pose d'Ariane, aucune pose humaine)
- **Entrée** : la liste d'ESV de la partie telle que le lot la lit à son départ (bords monde des deux rails de chaque coupe, statut, drapeaux).
- **Trajectoire** : cheminée de plan de coupe en plan de coupe (`outils/trajectoire.cjs`).
- **Axe de la voie** : modèle cinématique à deux pivots, **a = 4 m, w = 14 m, communs à toutes les parties** ; le **sens** (±1) est choisi par partie au plus petit coût de voie courante.
  - Choix de (a, w) SANS la vérité : plus petit coût de voie courante sommé sur les 22 listes, restreint aux lignes à forte dynamique (courbure de la trajectoire au-delà de 3, 4 ou 6 mrad/m à ±15 cuts) : (4 ; 14) est 1er, 3e et 2e des trois seuils (voisins : 3,75 ; 15 et 3,5 ; 16). Le coût sur toutes les lignes ne départage pas la vallée a(a+w)/2 ≈ 36 m² (2,85 à 3,2).
  - Déclaré : j'ai aussi regardé l'erreur contre la pose finale sur une grille (a, w) ; elle préfère la même famille (3,5 à 4 ; 14 à 17). Le choix ne s'appuie pas sur elle, mais je l'ai vue. La mesure publiée de l'étape 1 était faite avec un ajustement par partie ; avec (4 ; 14) : pose finale à 27,0 mm de l'axe au plus (792 cuts jugés), poses fausses à 118 mm au moins, 30 désignations sur 30.
- **Constante en travers** : médiane du résidu des lignes de voie courante intactes (statut valide, aucun drapeau, écartement 1 428 à 1 446 mm) à ±200 cuts (30 lignes au moins ; sinon ±400, ±800, ±1 600).
- **L'ancre se tait** (le levier ne fait alors rien) :
  1. pas de liste, ligne du cut absente, ou pose de départ de la capture qui ne se cale pas sur la ligne du cut (translation monde − scène différente entre les deux rails de plus de 2 mm, ou différente de celle des autres cuts du lot de plus de 5 mm) ;
  2. cut à moins de a + w + 2 m (20 m) d'un bout de la liste (le modèle n'a pas la trajectoire sous les deux pivots) ;
  3. moins de 30 lignes de voie courante à ±1 600 cuts ;
  4. sens non établi (rapport des coûts des deux sens inférieur à 1,10) ET correction cinématique au cut de plus de 20 mm en valeur absolue.

## 2. Le levier « refus d'ancre » (clé `ancre`, `null` = éteint = livré)
- **θ = 75 mm**, fixé a priori au milieu du trou mesuré à l'étape 1 (poses finales à 36,4 mm au plus, poses fausses à 121 mm au moins), sans grille ni réglage par lot (consigne de l'intégrateur).
- **Règle** : toute pose que le lot s'apprête à valider (chaîne, L1-s, GCV2, recherche large, deuxième passe), dans toute zone, dont le milieu des deux rails est à plus de θ en travers de l'axe prédit, n'est pas posée : le cut est différé (motif `ancre`). Aucune zone n'entre dans la règle (R5 sans objet).
- **Sans ricochet (variante figée `N`)** : la pose refusée continue de nourrir appuis, voisins, transport et mémoire de grappe exactement comme le code livré ; un cut refusé n'est pas repris par la deuxième passe. Tout cut non refusé garde donc la décision et la pose du livré, à l'identique (à prouver au rejeu : seuls les cuts refusés changent).
- Rien d'autre ne change : ni le pool, ni le choix de la GCV2, ni aucune pose.

## 3. Ce qui sera jugé, dans l'ordre (R1)
1. Éteint = livré (4 016 / 4 016).
2. Garde d'octobre au banc (`banc.cjs garde`). Un refus laisse un cut sans pose : la garde le comptera (critère 1 et « verts changés »). Chaque refus d'octobre est donc jugé contre la vérité d'octobre (R6) : vraie correction (pose refusée à plus de 50 mm de la vérité) ou vraie faute (pose refusée à 10 mm au plus de la vérité). **Critère écrit d'avance : aucune vraie faute, aucun recul hors des cuts refusés.**
3. Validation croisée par lot : il n'y a aucun réglage à choisir ; le tableau par lot tenu à l'écart est celui du réglage unique.
4. Parité banc / service worker.
5. Comptes à part (R3) : poses de la chaîne refusées ; décisions changées hors des cuts refusés (attendu : 0) ; cas sans ancre, par motif.

## 4. Variante suivante, seulement après le jugement de `N` (nouveau réglage, figé à part)
Après un refus, la GCV2 redécide le cut sur le pool restreint aux paires dont le milieu est à θ au plus de l'axe (au lieu de différer). Non figée ici.

## Note du 14/11 : arbre, empreintes, passe fidèle (écrite avant le rejeu du corpus avec la passe)
- **Arbre.** Le tronc (9feb278) a ajouté au banc deux options de mesure : zones du journal (`BANC_ZONES=journal`) et plafond d'écriture de la passe (`BANC_PASSE_PLAFOND`). Le tronc est fusionné dans le chantier (4d9a77d) et `ancre.patch` est régénéré sur cet arbre : mêmes lignes ajoutées et retirées, seul le contexte change. Rien du réglage ne change.
- **Empreintes de `ancre.patch`** : ancienne (arbre de a4eef66, celle de la garde d'octobre et de la mesure réservée) `214e55aaf166782ae072e8f968c61df2dc1ffaabba22ed15bcf5c420f733b87b` ; nouvelle (s'applique sur le tronc) `55c63f314ac2c379dff3c9eeed9aae60a4a9f65bf6d6517198d5895bc868467c`. `sw-ancre.patch` : inchangé, `5c7c1fef2d3c0af5126af147dd1d9ccecdd0c44089dc2026213815b198940f31`.
- **Jugements à partir d'ici** (décision de l'intégrateur) : `BANC_ZONES=journal`, passe livrée (`deuxiemePasse` 2, `sansVoieRien`) avec `BANC_PASSE_PLAFOND=10` ; la référence « livré » est rejouée avec les mêmes réglages. « Éteint = livré » est refait sur cet arbre.
- **Précision sur la passe, avant de la rejouer.** Une pose de la deuxième passe que l'ancre refuse n'entre pas dans la liste d'écriture : elle ne prend aucune des 10 écritures et n'arrête pas l'écriture. Le patch du service worker ne touche pas à l'écriture vers ESV. Conséquence possible, que « sans ricochet » ne couvrait pas : une pose que le livré décidait en ombre sans l'écrire (plafond atteint, ou arrêt de l'écriture sur la pose refusée) peut être écrite. Ces cuts sont comptés à part, listés et jugés un par un contre la vérité ; le plafond de 10 tient dans tous les cas.
